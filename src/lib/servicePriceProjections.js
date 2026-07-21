export const BOOKING_PRICE_PROJECTION_STORAGE_KEY = 'ipawcus-booking-price-projections';
export const BOOKING_PRICE_PROJECTION_UPDATED_EVENT = 'ipawcus-booking-price-projections-updated';

export const SERVICE_PRICE_PROJECTIONS = Object.freeze({
    onlineConsultation: '\u20b1500 per session',
    generalConsultation: '\u20b1400',
    parasiteControl: 'Starts at \u20b1200',
    vaccination: '\u20b1300\u2013\u20b11,200 per vaccine',
    grooming: '\u20b1500\u2013\u20b11,200, depending on size',
    dentalAssessment: '\u20b1400',
    dentalCleaning: 'Starts at \u20b13,000',
    surgery: 'Price after veterinary assessment',
    kapon: 'Starts at \u20b11,500',
    specialSurgery: '\u20b15,000\u2013\u20b120,000+, depending on procedure'
});

export const GROOMING_PRICE_MATRIX = Object.freeze([
    { service: 'Bath and Blow-dry', small: '\u20b1300', medium: '\u20b1400', large: '\u20b1550', xl: '\u20b1700' },
    { service: 'Full Grooming', small: '\u20b1500', medium: '\u20b1650', large: '\u20b1850', xl: '\u20b11,100' },
    { service: 'Nail Trimming', small: '\u20b1150', medium: '\u20b1150', large: '\u20b1200', xl: '\u20b1250' },
    { service: 'Ear Cleaning', small: '\u20b1150', medium: '\u20b1150', large: '\u20b1200', xl: '\u20b1250' },
    { service: 'Dematting Add-on', small: '\u20b1200', medium: '\u20b1300', large: '\u20b1400', xl: '\u20b1500' }
]);

export const KAPON_PRICE_MATRIX = Object.freeze([
    { procedure: 'Male Cat Neuter', price: '\u20b11,500' },
    { procedure: 'Female Cat Spay', price: '\u20b12,500' },
    { procedure: 'Male Dog Neuter, up to 10 kg', price: '\u20b12,500' },
    { procedure: 'Female Dog Spay, up to 10 kg', price: '\u20b14,000' },
    { procedure: 'Additional weight charge', price: '\u20b1500 per additional 5 kg' },
    { procedure: 'Pre-operative Screening', price: '\u20b11,000' }
]);

export const HOME_SERVICE_PRICE_PROJECTIONS = Object.freeze([
    { id: 'home-visit-consultation', name: 'Home Visit + Consultation within Lucena', price: 'Starts at \u20b11,400' },
    { id: 'outside-lucena', name: 'Outside Lucena', price: 'Quoted by location' },
    { id: 'vaccines', name: 'Vaccines', price: 'Add regular vaccine price' },
    { id: 'deworming', name: 'Deworming', price: 'Add weight-based price' },
    { id: 'medication-administration', name: 'Medication Administration', price: '\u20b1250 professional fee + medicine' },
    { id: 'wound-care', name: 'Wound Care', price: '\u20b1400\u2013\u20b11,000 + materials' },
    { id: 'home-grooming', name: 'Home Grooming', price: '\u20b1700\u2013\u20b11,300 + applicable travel charge' },
    { id: 'bath-blow-dry', name: 'Bath and Blow-dry', price: '\u20b1400\u2013\u20b1800' },
    { id: 'nail-trimming', name: 'Nail Trimming Add-on', price: '\u20b1150\u2013\u20b1250' },
    { id: 'ear-cleaning', name: 'Ear Cleaning Add-on', price: '\u20b1150\u2013\u20b1250' }
]);

export const SERVICE_DETAIL_PROJECTIONS = Object.freeze({
    generalConsultation: {
        includedTitle: "What's Included:",
        includedItems: [
            'Physical examination',
            'Weight and temperature check',
            'Heart and lung assessment',
            'Dental evaluation',
            'Health consultation'
        ],
        duration: '30-45 minutes',
        reviewNote: "Your booking will be reviewed by our team. You'll receive a confirmation email once approved."
    },
    parasiteControl: {
        includedTitle: "What's Included:",
        includedItems: [
            'Flea and tick treatment',
            'Deworming medication',
            'Parasite screening',
            'Prevention plan',
            'Follow-up care guidance'
        ],
        duration: '20-30 minutes',
        reviewNote: "Your booking will be reviewed by our team. You'll receive a confirmation email once approved."
    },
    vaccination: {
        includedTitle: 'Common Vaccines:',
        includedItems: [
            'Rabies vaccine',
            '5-in-1 vaccine',
            'Booster shots',
            'Vaccination certificate',
            'Next due-date guidance'
        ],
        duration: '15-20 minutes',
        reviewNote: "Please bring your pet's vaccination record if available."
    },
    grooming: {
        includedTitle: 'Services Include:',
        includedItems: [
            'Bath and blow dry',
            'Hair cut and styling',
            'Nail trimming',
            'Ear cleaning',
            'Teeth brushing'
        ],
        duration: '1-3 hours (varies by size)',
        reviewNote: "Your booking will be reviewed by our team. You'll receive a confirmation email once approved."
    },
    dental: {
        includedTitle: "What's Included:",
        includedItems: [
            'Oral examination',
            'Teeth and gum assessment',
            'Dental cleaning',
            'Tartar removal',
            'Oral health recommendations'
        ],
        duration: '45-90 minutes',
        reviewNote: "Your booking will be reviewed by our team. You'll receive a confirmation email once approved."
    },
    surgery: {
        includedTitle: 'Services Include:',
        includedItems: [
            'Pre-surgical consultation',
            'Surgical procedures',
            'Anesthesia monitoring',
            'Post-operative care',
            'Follow-up appointments'
        ],
        duration: 'Varies by procedure',
        reviewNote: 'All surgical procedures require a pre-operative consultation and examination.'
    }
});

export const DEFAULT_BOOKING_PRICE_PROJECTION_CONFIG = Object.freeze({
    servicePrices: SERVICE_PRICE_PROJECTIONS,
    groomingMatrix: GROOMING_PRICE_MATRIX,
    kaponMatrix: KAPON_PRICE_MATRIX,
    homeServices: HOME_SERVICE_PRICE_PROJECTIONS,
    serviceDetails: SERVICE_DETAIL_PROJECTIONS,
    instructions: Object.freeze({
        onlineConsultation: '',
        generalConsultation: '',
        parasiteControl: '',
        vaccination: '',
        grooming: '',
        dental: '',
        surgery: '',
        homeService: '',
        kapon: 'Final kapon pricing may change after sex, weight, anesthesia, testing, and medication assessment.',
        specialSurgery: 'Final surgery pricing is confirmed after veterinary assessment.'
    })
});

function text(value, fallback = '') {
    const next = value === null || value === undefined ? '' : String(value);
    return next.trim() === '' ? fallback : next;
}

function cloneRows(rows) {
    return rows.map((row) => ({ ...row }));
}

function defaultConfigClone() {
    return {
        servicePrices: { ...SERVICE_PRICE_PROJECTIONS },
        groomingMatrix: cloneRows(GROOMING_PRICE_MATRIX),
        kaponMatrix: cloneRows(KAPON_PRICE_MATRIX),
        homeServices: cloneRows(HOME_SERVICE_PRICE_PROJECTIONS),
        serviceDetails: Object.fromEntries(
            Object.entries(SERVICE_DETAIL_PROJECTIONS).map(([key, value]) => [
                key,
                {
                    includedTitle: value.includedTitle,
                    includedItems: [...value.includedItems],
                    duration: value.duration,
                    reviewNote: value.reviewNote
                }
            ])
        ),
        instructions: { ...DEFAULT_BOOKING_PRICE_PROJECTION_CONFIG.instructions }
    };
}

function mergeServicePrices(overrides) {
    const defaults = SERVICE_PRICE_PROJECTIONS;
    const source = overrides && typeof overrides === 'object' ? overrides : {};

    return Object.fromEntries(
        Object.entries(defaults).map(([key, value]) => [key, text(source[key], value)])
    );
}

function mergeRows(defaultRows, rows, fields, identityField) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const sourceByIdentity = new Map(
        sourceRows
            .filter((row) => row && typeof row === 'object')
            .map((row) => [String(row[identityField] || '').toLowerCase(), row])
    );

    return defaultRows.map((defaultRow, index) => {
        const source = sourceByIdentity.get(String(defaultRow[identityField] || '').toLowerCase()) || sourceRows[index] || {};
        return Object.fromEntries(
            fields.map((field) => [field, text(source[field], defaultRow[field])])
        );
    });
}

function mergeInstructions(instructions) {
    const defaults = DEFAULT_BOOKING_PRICE_PROJECTION_CONFIG.instructions;
    const source = instructions && typeof instructions === 'object' ? instructions : {};

    return Object.fromEntries(
        Object.entries(defaults).map(([key, value]) => [key, text(source[key], value)])
    );
}

function mergeServiceDetails(details) {
    const source = details && typeof details === 'object' ? details : {};

    return Object.fromEntries(
        Object.entries(SERVICE_DETAIL_PROJECTIONS).map(([key, value]) => {
            const sourceDetail = source[key] && typeof source[key] === 'object' ? source[key] : {};
            const sourceItems = Array.isArray(sourceDetail.includedItems)
                ? sourceDetail.includedItems.map((item) => text(item)).filter(Boolean)
                : [];

            return [
                key,
                {
                    includedTitle: text(sourceDetail.includedTitle, value.includedTitle),
                    includedItems: sourceItems.length > 0 ? sourceItems : [...value.includedItems],
                    duration: text(sourceDetail.duration, value.duration),
                    reviewNote: text(sourceDetail.reviewNote, value.reviewNote)
                }
            ];
        })
    );
}

export function mergeBookingPriceProjectionConfig(overrides = {}) {
    if (!overrides || typeof overrides !== 'object') {
        return defaultConfigClone();
    }

    return {
        servicePrices: mergeServicePrices(overrides.servicePrices),
        groomingMatrix: mergeRows(
            GROOMING_PRICE_MATRIX,
            overrides.groomingMatrix,
            ['service', 'small', 'medium', 'large', 'xl'],
            'service'
        ),
        kaponMatrix: mergeRows(
            KAPON_PRICE_MATRIX,
            overrides.kaponMatrix,
            ['procedure', 'price'],
            'procedure'
        ),
        homeServices: mergeRows(
            HOME_SERVICE_PRICE_PROJECTIONS,
            overrides.homeServices,
            ['id', 'name', 'price'],
            'id'
        ),
        serviceDetails: mergeServiceDetails(overrides.serviceDetails),
        instructions: mergeInstructions(overrides.instructions)
    };
}

export function includedItemsText(items) {
    return Array.isArray(items) ? items.join('\n') : '';
}

export function parseIncludedItems(value) {
    return String(value || '')
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
}

export function readBookingPriceProjectionConfig() {
    if (typeof window === 'undefined') {
        return defaultConfigClone();
    }

    try {
        const raw = window.localStorage.getItem(BOOKING_PRICE_PROJECTION_STORAGE_KEY);
        return mergeBookingPriceProjectionConfig(raw ? JSON.parse(raw) : {});
    } catch {
        return defaultConfigClone();
    }
}

export function saveBookingPriceProjectionConfig(config) {
    const normalized = mergeBookingPriceProjectionConfig(config);

    if (typeof window !== 'undefined') {
        window.localStorage.setItem(BOOKING_PRICE_PROJECTION_STORAGE_KEY, JSON.stringify(normalized));
        window.dispatchEvent(new CustomEvent(BOOKING_PRICE_PROJECTION_UPDATED_EVENT, { detail: normalized }));
    }

    return normalized;
}

export function resetBookingPriceProjectionConfig() {
    const normalized = defaultConfigClone();

    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(BOOKING_PRICE_PROJECTION_STORAGE_KEY);
        window.dispatchEvent(new CustomEvent(BOOKING_PRICE_PROJECTION_UPDATED_EVENT, { detail: normalized }));
    }

    return normalized;
}

export function homeServicePriceById(config, id) {
    const source = config?.homeServices || HOME_SERVICE_PRICE_PROJECTIONS;
    return source.find((item) => item.id === id)?.price || '';
}

function specialServiceKey(service) {
    return [
        service?.serviceCode,
        service?.service_code,
        service?.serviceTitle,
        service?.service_title,
        service?.serviceName,
        service?.service_name
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

export function isKaponProjectionService(service) {
    const key = specialServiceKey(service);
    return key.includes('kapon') || key.includes('spay') || key.includes('neuter');
}

export function isSpecialSurgeryProjectionService(service) {
    const key = specialServiceKey(service);
    return key.includes('special-surgery') || key.includes('special surgery');
}

export function getSpecialServiceProjectionLabel(service, fallback = 'To be announced', config = null) {
    const servicePrices = config?.servicePrices || SERVICE_PRICE_PROJECTIONS;

    if (isKaponProjectionService(service)) {
        return servicePrices.kapon;
    }

    if (isSpecialSurgeryProjectionService(service)) {
        return servicePrices.specialSurgery;
    }

    return fallback;
}
